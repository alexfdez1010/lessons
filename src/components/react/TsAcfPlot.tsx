import { useId, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface TsAcfPlotProps {
  /** Heading above the chart. */
  title?: string;
  /** Label for the white-noise option. */
  whiteNoiseLabel?: string;
  /** Label for the AR(1) positive-autocorrelation option. */
  arLabel?: string;
  /** Label for the MA(1) one-lag-spike option. */
  maLabel?: string;
  /** Label for the x-axis (lag). */
  lagLabel?: string;
  /** Label for the y-axis (autocorrelation). */
  acfLabel?: string;
  /** Label for the significance band. */
  bandLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

type Pattern = 'white' | 'ar' | 'ma';

const MAX_LAG = 14;
// 95% white-noise band ≈ 2/√n; pick a representative half-width for the display.
const BAND = 0.18;

// Theoretical ACF values for each pattern, lag 1..MAX_LAG.
const acfFor = (pattern: Pattern): number[] => {
  const out: number[] = [];
  for (let k = 1; k <= MAX_LAG; k++) {
    if (pattern === 'white') {
      // Tiny sampling wiggle around zero, mostly inside the band.
      out.push(((k * 37) % 11) / 11 - 0.5 > 0 ? 0.05 : -0.06);
    } else if (pattern === 'ar') {
      // AR(1) with phi=0.7: geometric decay phi^k.
      out.push(0.7 ** k);
    } else {
      // MA(1) with theta=0.8: single spike at lag 1, zero after.
      out.push(k === 1 ? 0.45 : ((k * 23) % 7) / 7 - 0.5 > 0 ? 0.04 : -0.05);
    }
  }
  return out;
};

/**
 * An autocorrelation-function (ACF) stem plot that toggles between three
 * canonical patterns: white noise (all bars inside the significance band — no
 * structure), an AR(1) process (a smooth geometric decay across many lags), and
 * an MA(1) process (a single significant spike at lag 1, then nothing). The grey
 * band is the ±2/√n white-noise confidence interval; bars poking outside it are
 * "significant" autocorrelations. Selecting a pattern animates the bars via a
 * CSS transition on their height, respecting prefers-reduced-motion globally.
 */
export function TsAcfPlot({
  title = 'ACF signatures: white noise, AR(1), MA(1)',
  whiteNoiseLabel = 'White noise',
  arLabel = 'AR(1) decay',
  maLabel = 'MA(1) spike',
  lagLabel = 'Lag k',
  acfLabel = 'Autocorrelation',
  bandLabel = 'White-noise band (±2/√n)',
  caption = 'White noise leaves every bar inside the grey band — no forecastable structure. An AR(1) decays geometrically across many lags; an MA(1) fires one significant spike at lag 1 and then collapses. Reading these shapes is how you pick a model.',
  className,
}: TsAcfPlotProps) {
  const id = useId();
  const [pattern, setPattern] = useState<Pattern>('white');
  const values = acfFor(pattern);

  const W = 520;
  const H = 240;
  const padLeft = 40;
  const padRight = 12;
  const padTop = 16;
  const padBottom = 30;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  const yMax = 1;
  const yMin = -0.3;
  const yToPx = (y: number) =>
    padTop + (1 - (y - yMin) / (yMax - yMin)) * plotH;
  const zeroY = yToPx(0);
  const slot = plotW / MAX_LAG;

  const buttons: { key: Pattern; label: string }[] = [
    { key: 'white', label: whiteNoiseLabel },
    { key: 'ar', label: arLabel },
    { key: 'ma', label: maLabel },
  ];

  const bandTopY = yToPx(BAND);
  const bandBotY = yToPx(-BAND);

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="font-medium text-ink-900">{title}</figcaption>

      <div className="mt-4 flex flex-wrap gap-2">
        {buttons.map((b) => (
          <button
            key={b.key}
            type="button"
            onClick={() => setPattern(b.key)}
            aria-pressed={pattern === b.key}
            className={cx(
              'rounded-pill border px-3 py-1.5 text-sm font-medium shadow-soft transition',
              pattern === b.key
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-ink-100 bg-surface-50 text-ink-700 hover:bg-surface-100',
            )}
          >
            {b.label}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-5 rounded bg-ink-100" aria-hidden="true" />
          {bandLabel}
        </span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-3 w-full"
        role="img"
        aria-label={`An ACF stem plot for the ${pattern === 'white' ? 'white noise' : pattern === 'ar' ? 'AR(1)' : 'MA(1)'} pattern, with bars at lags 1 to ${MAX_LAG} and a shaded white-noise significance band.`}
      >
        {/* Significance band */}
        <rect
          x={padLeft}
          y={bandTopY}
          width={plotW}
          height={bandBotY - bandTopY}
          fill="var(--color-ink-100)"
          opacity={0.6}
        />

        {/* Zero axis */}
        <line
          x1={padLeft}
          y1={zeroY}
          x2={W - padRight}
          y2={zeroY}
          stroke="var(--color-ink-400)"
        />

        {/* y gridlines */}
        {[1, 0.5, 0, -0.3].map((g, i) => {
          const gy = yToPx(g);
          return (
            <g key={`g-${i}`}>
              <text
                x={padLeft - 6}
                y={gy + 3}
                fontSize={10}
                fill="var(--color-ink-700)"
                textAnchor="end"
              >
                {g.toFixed(1)}
              </text>
            </g>
          );
        })}

        {/* Stems */}
        {values.map((v, idx) => {
          const cxPos = padLeft + slot * idx + slot / 2;
          const topY = yToPx(v);
          const significant = Math.abs(v) > BAND;
          return (
            <g key={`stem-${idx}`}>
              <line
                x1={cxPos}
                y1={zeroY}
                x2={cxPos}
                y2={topY}
                stroke={
                  significant ? 'var(--color-brand-500)' : 'var(--color-ink-400)'
                }
                strokeWidth={3}
                style={{ transition: 'all 400ms ease' }}
              />
              <circle
                cx={cxPos}
                cy={topY}
                r={3}
                fill={
                  significant ? 'var(--color-brand-500)' : 'var(--color-ink-400)'
                }
                style={{ transition: 'all 400ms ease' }}
              />
              {idx % 2 === 0 && (
                <text
                  x={cxPos}
                  y={H - 14}
                  fontSize={9}
                  fill="var(--color-ink-600)"
                  textAnchor="middle"
                >
                  {idx + 1}
                </text>
              )}
            </g>
          );
        })}

        <text
          x={padLeft + plotW / 2}
          y={H - 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
        >
          {lagLabel}
        </text>
        <text
          x={12}
          y={padTop + plotH / 2}
          fontSize={11}
          fill="var(--color-ink-700)"
          textAnchor="middle"
          transform={`rotate(-90 12 ${padTop + plotH / 2})`}
        >
          {acfLabel}
        </text>
      </svg>

      <p className="mt-3 text-sm leading-relaxed text-ink-600" id={`${id}-cap`}>
        {caption}
      </p>
    </figure>
  );
}

export default TsAcfPlot;
