import { useId, useMemo, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface RorExpectancyBarsProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the win-rate slider. */
  winRateLabel?: string;
  /** Label for the payoff-ratio slider (avg win ÷ avg loss). */
  payoffLabel?: string;
  /** Label for the positive average win contribution bar. */
  winContribLabel?: string;
  /** Label for the negative average loss contribution bar. */
  lossContribLabel?: string;
  /** Label for the net expectancy readout. */
  expectancyLabel?: string;
  /** Caption indicating an edge (positive expectancy). */
  edgeCaption?: string;
  /** Caption indicating a loss (negative expectancy). */
  losingCaption?: string;
  /** Initial win rate as a fraction. Defaults to 0.4. */
  winRate?: number;
  /** Initial payoff ratio (avg win ÷ avg loss). Defaults to 2. */
  payoff?: number;
  className?: string;
}

/**
 * Visualizes expectancy as two stacked contributions: win rate times average
 * win (the green up-bar) minus loss rate times average loss (the red down-bar),
 * netting to expectancy per dollar risked (in R-multiples, with the average loss
 * normalized to 1R). Sliders move win rate and payoff ratio; the bars rescale
 * and the net expectancy readout flips color and caption when it crosses zero.
 * Shows the win-rate-vs-payoff trade-off live: a low win rate can still be
 * profitable with a high payoff ratio. Pure SVG, deterministic, no animation.
 */
export function RorExpectancyBars({
  title = 'Expectancy = win rate × avg win − loss rate × avg loss',
  winRateLabel = 'Win rate',
  payoffLabel = 'Payoff ratio (avg win ÷ avg loss)',
  winContribLabel = 'Win side: p × W',
  lossContribLabel = 'Loss side: (1−p) × L',
  expectancyLabel = 'Expectancy per 1R risked',
  edgeCaption = 'Positive expectancy — each trade adds value on average. This system has an edge.',
  losingCaption = 'Negative expectancy — each trade bleeds value on average. No position size can fix a losing system.',
  winRate = 0.4,
  payoff = 2,
  className,
}: RorExpectancyBarsProps) {
  const id = useId();
  const [winPct, setWinPct] = useState(Math.round(winRate * 100));
  const [payoffX10, setPayoffX10] = useState(Math.round(payoff * 10));

  const p = winPct / 100;
  const R = payoffX10 / 10; // payoff ratio, avg loss normalized to 1R
  // Expectancy in R: p·R − (1−p)·1
  const winContrib = p * R;
  const lossContrib = (1 - p) * 1;
  const expectancy = winContrib - lossContrib;

  const W = 420;
  const H = 240;
  const midX = W / 2;
  const zeroY = H / 2;
  const maxMag = useMemo(() => Math.max(winContrib, lossContrib, 1.2), [winContrib, lossContrib]);
  const scale = (zeroY - 24) / maxMag;

  const winH = winContrib * scale;
  const lossH = lossContrib * scale;
  const barW = 70;

  const positive = expectancy >= 0;
  const fmt = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;

  return (
    <figure
      className={cx('my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft', className)}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span
          className={cx(
            'rounded-pill px-3 py-1 text-sm font-medium text-white',
            positive ? 'bg-brand-600' : 'bg-danger',
          )}
          aria-live="polite"
        >
          {expectancyLabel}: {fmt(expectancy)}
        </span>
      </figcaption>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-4 w-full"
        role="img"
        aria-label={`With a ${winPct} percent win rate and a payoff ratio of ${R.toFixed(1)}, expectancy is ${fmt(expectancy)} per unit risked.`}
      >
        {/* Zero baseline */}
        <line x1={20} y1={zeroY} x2={W - 20} y2={zeroY} stroke="var(--color-ink-300)" />
        <text x={W - 18} y={zeroY - 4} fontSize={10} fill="var(--color-ink-500)" textAnchor="end">
          0
        </text>

        {/* Win contribution bar (up, green) */}
        <rect
          x={midX - barW - 16}
          y={zeroY - winH}
          width={barW}
          height={winH}
          fill="var(--color-brand-500)"
          rx={3}
        />
        <text x={midX - barW - 16 + barW / 2} y={zeroY - winH - 6} fontSize={11} fontWeight={600} fill="var(--color-brand-600)" textAnchor="middle">
          {`+${winContrib.toFixed(2)}`}
        </text>

        {/* Loss contribution bar (down, red) */}
        <rect
          x={midX + 16}
          y={zeroY}
          width={barW}
          height={lossH}
          fill="var(--color-danger)"
          rx={3}
        />
        <text x={midX + 16 + barW / 2} y={zeroY + lossH + 14} fontSize={11} fontWeight={600} fill="var(--color-danger)" textAnchor="middle">
          {`−${lossContrib.toFixed(2)}`}
        </text>

        {/* Net expectancy marker line */}
        <line
          x1={20}
          y1={zeroY - expectancy * scale}
          x2={W - 20}
          y2={zeroY - expectancy * scale}
          stroke={positive ? 'var(--color-brand-600)' : 'var(--color-danger)'}
          strokeWidth={2}
          strokeDasharray="6 4"
        />

        <text x={midX - barW - 16 + barW / 2} y={H - 6} fontSize={10} fill="var(--color-ink-600)" textAnchor="middle">
          {winContribLabel}
        </text>
        <text x={midX + 16 + barW / 2} y={H - 6} fontSize={10} fill="var(--color-ink-600)" textAnchor="middle">
          {lossContribLabel}
        </text>
      </svg>

      {/* Win-rate slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-wr`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{winRateLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {winPct}%
          </span>
        </label>
        <input
          id={`${id}-wr`}
          type="range"
          min={5}
          max={95}
          step={1}
          value={winPct}
          onChange={(e) => setWinPct(Number(e.target.value))}
          aria-valuetext={`${winPct} percent win rate`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      {/* Payoff slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-pay`} className="flex items-center justify-between gap-3 text-sm font-medium text-ink-700">
          <span>{payoffLabel}</span>
          <span className="font-mono text-brand-600" aria-hidden="true">
            {R.toFixed(1)}×
          </span>
        </label>
        <input
          id={`${id}-pay`}
          type="range"
          min={5}
          max={50}
          step={1}
          value={payoffX10}
          onChange={(e) => setPayoffX10(Number(e.target.value))}
          aria-valuetext={`payoff ratio ${R.toFixed(1)}`}
          className="mt-2 w-full accent-brand-500"
        />
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">
        {positive ? edgeCaption : losingCaption}
      </p>
    </figure>
  );
}

export default RorExpectancyBars;
