import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RiskReturnRaceProps {
  /** Heading above the chart. */
  title?: string;
  /** Labels for the two portfolios (smooth, jagged). */
  seriesLabels?: [string, string];
  /** Row labels for the three full-path metrics. */
  metricLabels?: [string, string, string];
  /** Volatility descriptor for the calm portfolio. */
  lowLabel?: string;
  /** Volatility descriptor for the wild portfolio. */
  highLabel?: string;
  /** Button label to start or resume the race. */
  playLabel?: string;
  /** Button label once the race has finished. */
  replayLabel?: string;
  /** Button label while the race is playing. */
  pauseLabel?: string;
  /** Label for the monthly observation slider. */
  observationLabel?: string;
  /** Horizontal axis label; the initial value is month zero. */
  xAxisLabel?: string;
  /** Vertical axis label including the initial index value. */
  yAxisLabel?: string;
  /** Locale for numeric readouts. */
  locale?: string;
  /** Accessible description with {title}, {smooth}, {jagged}, {observation}, {total}, {smoothValue}, {jaggedValue}. */
  chartLabel?: string;
  /** Assumptions and method behind the full-path statistics. */
  methodologyLabel?: string;
  /** Interpretation shown with the full-path statistics. */
  caption?: string;
  className?: string;
}

// Twelve illustrative index observations give eleven monthly returns. These
// paths are a controlled comparison, not a sample of market performance.
const SMOOTH = [100, 104, 108, 113, 118, 122, 127, 133, 139, 146, 153, 160];
const JAGGED = [100, 88, 112, 95, 130, 84, 140, 108, 150, 96, 138, 160];
const MONTHS = SMOOTH.length - 1;

function fullPathMetrics(series: readonly number[]) {
  const returns = series.slice(1).map((value, i) => value / series[i] - 1);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  const monthlyVolatility = Math.sqrt(variance);
  return {
    totalReturn: series[series.length - 1] / series[0] - 1,
    volatility: monthlyVolatility * Math.sqrt(12),
    // Monthly excess returns equal returns under the stated zero-riskfree
    // convention. Arithmetic mean, not total return, is the numerator.
    sharpe: (mean / monthlyVolatility) * Math.sqrt(12),
  };
}

const SMOOTH_METRICS = fullPathMetrics(SMOOTH);
const JAGGED_METRICS = fullPathMetrics(JAGGED);

/** Compare two complete paths with the same cumulative return. Playback and a
 * month slider let the learner inspect both portfolios at the same date. Full
 * paths render on the server; playback starts only when requested. */
export function RiskReturnRace({
  title = 'Same return, different risk',
  seriesLabels = ['Steady Eddie', 'Rollercoaster'],
  metricLabels = ['Total return', 'Volatility (risk)', 'Sharpe ratio'],
  lowLabel = 'low',
  highLabel = 'high',
  playLabel = 'Play the race',
  replayLabel = 'Replay',
  pauseLabel = 'Pause',
  observationLabel = 'Month',
  xAxisLabel = 'Month',
  yAxisLabel = 'Portfolio value, start 100',
  locale = 'en-US',
  chartLabel = '{title}. Month {observation} of {total}: {smooth} is at {smoothValue}; {jagged} is at {jaggedValue}. Both full paths end at 160 from a starting value of 100.',
  methodologyLabel = 'Illustrative monthly paths with 11 returns. Volatility is the sample monthly standard deviation × √12; Sharpe is the monthly mean ÷ that standard deviation × √12, with a zero risk-free rate. These annualized figures use the usual no-serial-correlation convention; this short example does not estimate future performance.',
  caption = 'Both paths finish at +60%. The smoother path has a higher Sharpe ratio here. Sharpe uses average monthly excess return, so equal total returns alone do not fix its numerator.',
  className,
}: RiskReturnRaceProps) {
  const id = useId();
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const rafRef = useRef<number | null>(null);

  const W = 440;
  const H = 200;
  const padX = 6;
  const padY = 8;
  const minV = 80;
  const maxV = 160;
  const x = (month: number) => padX + (month / MONTHS) * (W - padX * 2);
  const y = (value: number) => padY + (1 - (value - minV) / (maxV - minV)) * (H - padY * 2);

  const partialPath = (series: readonly number[]) => {
    const position = progress * MONTHS;
    const last = Math.floor(position);
    const fraction = position - last;
    let path = `M ${x(0)} ${y(series[0])}`;
    for (let i = 1; i <= last && i <= MONTHS; i++) path += ` L ${x(i)} ${y(series[i])}`;
    if (last < MONTHS && fraction > 0) {
      path += ` L ${x(position)} ${y(series[last] + (series[last + 1] - series[last]) * fraction)}`;
    }
    return path;
  };

  const togglePlayback = () => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setHasPlayed(true);
    if (typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setProgress(1);
      return;
    }
    if (progress >= 1) setProgress(0);
    setPlaying(true);
  };

  useEffect(() => {
    if (!playing) return;
    const media = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    const finishWithoutMotion = () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      setProgress(1);
      setPlaying(false);
    };
    if (media?.matches) {
      finishWithoutMotion();
      return;
    }
    const onMotionChange = () => {
      if (media?.matches) finishWithoutMotion();
    };
    media?.addEventListener('change', onMotionChange);
    const initialProgress = progress;
    let startTs: number | null = null;
    const step = (timestamp: number) => {
      if (startTs === null) startTs = timestamp;
      const next = Math.min(1, initialProgress + (timestamp - startTs) / 2600);
      setProgress(next);
      if (next < 1) rafRef.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      media?.removeEventListener('change', onMotionChange);
    };
    // Capture the current progress when starting or resuming. Updating it during
    // playback must not restart this effect on every animation frame.
  }, [playing]);

  const complete = progress >= 1;
  const observation = Math.min(MONTHS, Math.floor(progress * MONTHS));
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 });
  const totalPercent = new Intl.NumberFormat(locale, { style: 'percent', signDisplay: 'always', maximumFractionDigits: 0 });
  const values = {
    title,
    smooth: seriesLabels[0],
    jagged: seriesLabels[1],
    observation: number.format(observation),
    total: number.format(MONTHS),
    smoothValue: number.format(SMOOTH[observation]),
    jaggedValue: number.format(JAGGED[observation]),
  };
  const chartDescription = chartLabel.replace(
    /\{(title|smooth|jagged|observation|total|smoothValue|jaggedValue)\}/g,
    (_, key: keyof typeof values) => values[key],
  );
  const metrics = [
    { label: metricLabels[0], smooth: totalPercent.format(SMOOTH_METRICS.totalReturn), jagged: totalPercent.format(JAGGED_METRICS.totalReturn) },
    { label: metricLabels[1], smooth: `${percent.format(SMOOTH_METRICS.volatility)} (${lowLabel})`, jagged: `${percent.format(JAGGED_METRICS.volatility)} (${highLabel})` },
    { label: metricLabels[2], smooth: number.format(SMOOTH_METRICS.sharpe), jagged: number.format(JAGGED_METRICS.sharpe) },
  ];

  return (
    <figure className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}>
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <button type="button" onClick={togglePlayback} className="shrink-0 rounded-pill bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">
          {playing ? pauseLabel : complete && hasPlayed ? replayLabel : playLabel}
        </button>
      </figcaption>

      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-600" aria-hidden="true" />
          {seriesLabels[0]}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-600" aria-hidden="true" />
          {seriesLabels[1]}
        </span>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs text-ink-600">{yAxisLabel}</div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
          <div className="flex flex-col justify-between text-right font-mono text-xs tabular-nums text-ink-600" aria-hidden="true">
            {[maxV, (maxV + minV) / 2, minV].map((value) => <span key={value}>{number.format(value)}</span>)}
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={chartDescription}>
            {[80, 100, 120, 160].map((value) => (
              <line key={value} x1={padX} y1={y(value)} x2={W - padX} y2={y(value)} stroke="var(--color-ink-200)" strokeDasharray="3 5" />
            ))}
            <path d={partialPath(JAGGED)} fill="none" stroke="var(--color-accent-600)" strokeWidth={2.5} strokeDasharray="6 4" strokeLinejoin="round" strokeLinecap="round" />
            <path d={partialPath(SMOOTH)} fill="none" stroke="var(--color-brand-600)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={x(observation)} cy={y(SMOOTH[observation])} r={4} fill="var(--color-brand-600)" />
            <circle cx={x(observation)} cy={y(JAGGED[observation])} r={4} fill="var(--color-accent-600)" />
          </svg>
          <span />
          <div className="mt-1 flex justify-between font-mono text-xs text-ink-600" aria-hidden="true">
            <span>0</span><span>{MONTHS}</span>
          </div>
        </div>
        <div className="mt-1 text-center text-xs text-ink-600">{xAxisLabel}</div>
      </div>

      <div className="mt-4">
        <label htmlFor={`${id}-observation`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{observationLabel}</span><span className="font-mono text-ink-900">{values.observation} / {values.total}</span>
        </label>
        <input id={`${id}-observation`} type="range" min={0} max={MONTHS} step={1} value={observation} onChange={(event) => { setPlaying(false); setProgress(Number(event.target.value) / MONTHS); }} className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500" />
      </div>

      <dl className="mt-3 grid gap-3 text-sm min-[380px]:grid-cols-2">
        {seriesLabels.map((label, index) => (
          <div key={index} className="rounded-card bg-surface-sunken/40 px-3 py-2">
            <dt className="text-ink-600">{label}</dt>
            <dd className="m-0 font-mono text-lg font-semibold text-ink-900">{index === 0 ? values.smoothValue : values.jaggedValue}</dd>
          </div>
        ))}
      </dl>

      {complete && (
        <div className="mt-4" aria-live="polite">
          <table className="w-full table-fixed text-sm" id={`${id}-metrics`}>
            <thead>
              <tr className="text-ink-500">
                <th className="py-1 text-left font-medium" scope="col" />
                <th className="px-1 py-1 text-right font-medium text-brand-700" scope="col">{seriesLabels[0]}</th>
                <th className="py-1 text-right font-medium text-accent-600" scope="col">{seriesLabels[1]}</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((metric) => (
                <tr key={metric.label}>
                  <th className="py-2 pr-1 text-left font-normal text-ink-700" scope="row">{metric.label}</th>
                  <td className="px-1 py-2 text-right font-mono text-ink-900">{metric.smooth}</td>
                  <td className="py-2 text-right font-mono text-ink-900">{metric.jagged}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
          <p className="mt-2 text-xs leading-relaxed text-ink-600">{methodologyLabel}</p>
        </div>
      )}
    </figure>
  );
}

export default RiskReturnRace;
