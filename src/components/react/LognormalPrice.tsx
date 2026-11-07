import { useEffect, useId, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LognormalPriceProps {
  /** Heading above the chart. */
  title?: string;
  /** Spot price S0. Defaults to `100`. */
  spot?: number;
  /** Volatility σ as a decimal (0.25 = 25%). Defaults to `0.25`. */
  vol?: number;
  /** Time to expiry T in years. Defaults to `1`. */
  time?: number;
  /** Strike K. Defaults to `110`. */
  strike?: number;
  /** Option type — flips which side of K is shaded. Defaults to `'call'`. */
  type?: 'call' | 'put';
  /** Continuous annual pricing rate; Q price drift is rate minus dividend yield. */
  rate?: number;
  /** Continuous proportional annual dividend yield. */
  dividendYield?: number;
  /** Locale for human-readable amounts only, never native values or SVG paths. */
  locale?: string;
  /** Accessible description template. */
  chartLabel?: string;
  chartScrollLabel?: string;
  scrollHint?: string;
  measureLabel?: string;
  spotLabel?: string;
  priceAxisLabel?: string;
  yearUnitLabel?: string;
  /** Slider label for volatility. */
  volLabel?: string;
  /** Slider label for time to expiry. */
  timeLabel?: string;
  /** Slider label for the strike. */
  strikeLabel?: string;
  /** Toggle label for a call. */
  callLabel?: string;
  /** Toggle label for a put. */
  putLabel?: string;
  /** Readout label for the in-the-money probability. */
  probItmLabel?: string;
  /** Readout label for the median terminal price. */
  medianPriceLabel?: string;
  /** One-line takeaway shown under the chart. */
  caption?: string;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Standard normal CDF via the Abramowitz–Stegun erf approximation (max error ~1e-7).
const normCdf = (z: number): number => {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989422804014327 * Math.exp(-(z * z) / 2);
  const p =
    d *
    t *
    (0.31938153 +
      t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return z >= 0 ? 1 - p : p;
};

export interface LognormalPriceInputs { spot: number; volatility: number; time: number; strike: number; rate?: number; dividendYield?: number }
/** Continuous helper domain is independent of the legacy viewer's native grids. */
export function calculateLognormalPrice(x: LognormalPriceInputs) {
  const r = x.rate ?? 0, q = x.dividendYield ?? 0;
  if (![x.spot, x.volatility, x.time, x.strike, r, q].every(Number.isFinite) || x.spot <= 0 || x.strike <= 0 || x.volatility <= 0 || x.time <= 0 || x.spot > 1e9 || x.strike > 1e9 || x.volatility > 5 || x.time > 100 || Math.abs(r) > 2 || Math.abs(q) > 2) throw new Error('LognormalPrice: supply finite supported positive spot, strike, volatility and years, with matched annual continuous rate and dividend yield.');
  const sd = x.volatility * Math.sqrt(x.time), logMean = Math.log(x.spot) + (r - q - x.volatility * x.volatility / 2) * x.time, d2 = (Math.log(x.spot / x.strike) + (r - q - x.volatility * x.volatility / 2) * x.time) / sd, median = Math.exp(logMean), mean = x.spot * Math.exp((r - q) * x.time);
  if (sd === 0 || median <= 0 || ![sd, logMean, d2, median, mean].every(Number.isFinite)) throw new Error('LognormalPrice: the positive-dispersion density is outside its finite numerical domain; use supported scales or a separate deterministic boundary model.');
  return { sd, logMean, d2, median, mean, callProbability: normCdf(d2), putProbability: normCdf(-d2) };
}

/** Pricing-measure lognormal terminal density with Q ex-dividend drift r−q.
 * The finite plot indicates the exercise region; the full-CDF probability is
 * evaluated separately, including tails outside the plotted price window.
 * Defaults preserve the existing rate=yield=0 illustration. */
export function LognormalPrice({
  title = 'Where might the price land?',
  spot = 100,
  vol = 0.25,
  time = 1,
  strike = 110,
  type = 'call',
  rate = 0,
  dividendYield = 0,
  locale = 'en-US',
  chartLabel = '{title}. Under the Q lognormal model with continuous annual rate {rate} and dividend yield {yield}, volatility {volatility} and remaining years {time}, the {side} exercise probability is about {probability}. Median terminal price {median}. The finite density plot truncates tails; the readout evaluates the full CDF.',
  chartScrollLabel = 'Scrollable terminal-price density: {title}',
  scrollHint = 'Focus the density plot and use left/right arrow keys, or scroll horizontally, to read the full price axis.',
  measureLabel = 'Pricing-measure illustration: continuous annual r = {rate}, q = {yield}; Q ex-dividend price drift is r−q. The chart is a model density, not a physical forecast or an option value.',
  spotLabel = 'Current spot',
  priceAxisLabel = 'Horizontal: terminal price. Vertical shape: lognormal density, not option value.',
  yearUnitLabel = 'yr',
  volLabel = 'Volatility σ',
  timeLabel = 'Time to expiry (years)',
  strikeLabel = 'Strike K',
  callLabel = 'Call',
  putLabel = 'Put',
  probItmLabel = 'Probability in the money',
  medianPriceLabel = 'Median terminal price',
  caption = 'A Q lognormal density is a pricing-model assumption. The call shades prices above strike and the put below; their probabilities need not rise when volatility or time increases. The finite plot truncates tails, while the probability readout uses the full normal-CDF formula. Neither a density nor an exercise probability is an option price.',
  className,
}: LognormalPriceProps) {
  const isGrid = (value: number, min: number, max: number, step: number) => Number.isFinite(value) && value >= min && value <= max && Math.abs((value - min) / step - Math.round((value - min) / step)) < 1e-8;
  if (!Number.isFinite(spot) || spot < 2 || spot > 1e6 || !isGrid(vol, .05, .8, .01) || !isGrid(time, .1, 3, .1) || !isGrid(strike, Math.round(spot * .4), Math.round(spot * 2), 1) || !['call', 'put'].includes(type)) throw new Error('LognormalPrice: viewer author values must fit the unchanged native grids: volatility 5–80% by 1 percentage point, years 0.1–3 by 0.1 and integer strike within the spot-relative slider bounds. Supply finite spot 2–1,000,000. Continuous helper inputs have a separate domain.');
  calculateLognormalPrice({ spot, volatility: vol, time, strike, rate, dividendYield });
  const id = useId(), num = (value: number, digits = 2) => new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(value), pct = (value: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(value), percent = (value: number) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 2 }).format(value), coordinate = (value: number) => Number(value.toFixed(3)), pathNumber = (value: number) => coordinate(value).toString();
  const S0 = spot;
  const [volState, setVolState] = useState(vol);
  const [timeState, setTimeState] = useState(time);
  const [strikeState, setStrikeState] = useState(strike);
  const [typeState, setTypeState] = useState<'call' | 'put'>(type);
  const model = calculateLognormalPrice({ spot: S0, volatility: volState, time: timeState, strike: strikeState, rate, dividendYield });
  const W = 520;
  const H = 240;
  const padX = 28;
  const padY = 16;
  const padBottom = 28; // room for axis labels

  // Distribution parameters of ln(S_T).
  const sd = model.sd;
  const m = model.logMean;

  const pdf = (s: number): number => {
    if (s <= 0) return 0;
    const z = (Math.log(s) - m) / sd;
    return Math.exp(-(z * z) / 2) / (s * sd * Math.sqrt(2 * Math.PI));
  };

  // Price axis: span a generous range around spot that widens with σ√T.
  const sMax = Math.max(strikeState * 1.25, S0 * Math.exp(m - Math.log(S0) + 3.2 * sd));
  const xMax = Math.min(sMax, S0 * 8);
  const xMin = 0;

  const x = (s: number) => coordinate(padX + ((s - xMin) / (xMax - xMin)) * (W - padX * 2));

  const SAMPLES = 240;
  const grid: { s: number; p: number }[] = [];
  let pMax = 0;
  for (let i = 0; i <= SAMPLES; i++) {
    const s = xMin + (i / SAMPLES) * (xMax - xMin);
    const p = pdf(s);
    if (p > pMax) pMax = p;
    grid.push({ s, p });
  }
  const yTop = padY;
  const yBase = H - padBottom;
  const y = (p: number) => coordinate(yBase - (pMax > 0 ? p / pMax : 0) * (yBase - yTop));

  // Curve path.
  const curvePath = grid
    .map((g, i) => `${i === 0 ? 'M' : 'L'} ${pathNumber(x(g.s))} ${pathNumber(y(g.p))}`)
    .join(' ');

  // Shaded ITM region: for a call, S_T > K (right of strike); for a put, S_T < K.
  const isItm = (s: number) => (typeState === 'call' ? s > strikeState : s < strikeState);
  const shadedPoints = grid.filter((g) => isItm(g.s));
  let shadePath = '';
  if (shadedPoints.length > 0) {
    const first = shadedPoints[0];
    const last = shadedPoints[shadedPoints.length - 1];
    shadePath =
      `M ${pathNumber(x(first.s))} ${pathNumber(yBase)} ` +
      shadedPoints.map((g) => `L ${pathNumber(x(g.s))} ${pathNumber(y(g.p))}`).join(' ') +
      ` L ${pathNumber(x(last.s))} ${pathNumber(yBase)} Z`;
  }

  // The legacy normal-CDF approximation is unchanged; this is the full
  // modeled probability, not a numerical area over the truncated chart.
  const probItm = typeState === 'call' ? model.callProbability : model.putProbability;
  const median = model.median;

  // Strike / spot marker pixel positions.
  const strikeX = x(strikeState);
  const spotX = x(S0);

  // Smoothly morph the curve when σ or T change. We animate an opacity/scale-in
  // feel cheaply by transitioning a key off vol+time; respect reduced motion.
  const [morph, setMorph] = useState(1);
  const rafRef = useRef<number | null>(null);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (prefersReducedMotion()) {
      setMorph(1);
      return;
    }
    setMorph(0);
    const duration = 350;
    let startTs: number | null = null;
    const step = (ts: number) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      setMorph(p);
      if (p < 1) rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [volState, timeState]);

  const axisTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => xMin + f * (xMax - xMin));

  const description = chartLabel.replaceAll('{title}', title).replaceAll('{rate}', percent(rate)).replaceAll('{yield}', percent(dividendYield)).replaceAll('{volatility}', percent(volState)).replaceAll('{time}', num(timeState, 1)).replaceAll('{side}', typeState === 'call' ? callLabel : putLabel).replaceAll('{probability}', percent(probItm)).replaceAll('{median}', num(median));
  const measure = measureLabel.replaceAll('{rate}', percent(rate)).replaceAll('{yield}', percent(dividendYield));

  return (
    <figure
      className={cx(
        'not-prose my-6 min-w-0 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-brand-600 px-3 py-1 text-sm font-medium text-white">
          σ {percent(volState)} · T {num(timeState, 1)} {yearUnitLabel}
        </span>
      </figcaption>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{measure}</p>
      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-brand-500" aria-hidden="true" />
          {strikeLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-1 w-5 rounded-pill bg-accent-500" aria-hidden="true" />
          {medianPriceLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700"><span className="h-1 w-5 rounded-pill bg-ink-400" aria-hidden="true" />{spotLabel}</span>
      </div>

      <div role="region" tabIndex={0} aria-label={chartScrollLabel.replaceAll('{title}', title)} className="mt-3 max-w-full overflow-x-auto rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="block w-full min-w-[624px]"
        role="img"
        aria-label={description}
      >
        {/* Baseline */}
        <line
          x1={padX}
          y1={yBase}
          x2={W - padX}
          y2={yBase}
          stroke="var(--color-ink-200)"
        />
        {/* Axis ticks */}
        {axisTicks.map((tick, i) => (
          <g key={i}>
            <line
              x1={x(tick)}
              y1={yBase}
              x2={x(tick)}
              y2={yBase + 4}
              stroke="var(--color-ink-200)"
            />
            <text
              x={x(tick)}
              y={yBase + 18}
              textAnchor="middle"
              fontSize={12}
              fill="var(--color-ink-400)"
            >
              {num(tick, 0)}
            </text>
          </g>
        ))}

        {/* Shaded in-the-money probability mass */}
        {shadePath && (
          <path
            d={shadePath}
            fill="var(--color-brand-500)"
            opacity={0.15 * (0.4 + 0.6 * morph)}
          />
        )}

        {/* Density curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="var(--color-brand-500)"
          strokeWidth={3}
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity={0.5 + 0.5 * morph}
        />

        {/* Median terminal-price marker — accent */}
        <line
          x1={x(median)}
          y1={yTop}
          x2={x(median)}
          y2={yBase}
          stroke="var(--color-accent-500)"
          strokeWidth={2}
          strokeDasharray="4 4"
        />

        {/* Spot marker — faint */}
        <line
          x1={spotX}
          y1={yTop}
          x2={spotX}
          y2={yBase}
          stroke="var(--color-ink-400)"
          strokeDasharray="2 5"
        />

        {/* Strike marker — solid brand */}
        <line
          x1={strikeX}
          y1={yTop}
          x2={strikeX}
          y2={yBase}
          stroke="var(--color-brand-600)"
          strokeWidth={2.5}
        />
        <text
          x={Math.min(W - padX - 2, Math.max(padX + 12, strikeX))}
          y={yTop + 12}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="var(--color-brand-700)"
        >
          K
        </text>
      </svg>
      </div>
      <p className="mt-2 text-sm text-ink-700">{priceAxisLabel}</p>
      <p className="mt-2 text-sm text-ink-600">{scrollHint}</p>

      {/* Call / put toggle */}
      <div className="mt-4 inline-flex rounded-pill border border-ink-100 p-1" role="group" aria-label={`${callLabel} / ${putLabel}`}>
        <button
          type="button"
          aria-pressed={typeState === 'call'}
          onClick={() => setTypeState('call')}
          className={cx(
            'min-h-10 rounded-pill px-4 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            typeState === 'call'
              ? 'bg-brand-600 text-white'
              : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {callLabel}
        </button>
        <button
          type="button"
          aria-pressed={typeState === 'put'}
          onClick={() => setTypeState('put')}
          className={cx(
            'min-h-10 rounded-pill px-4 py-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600',
            typeState === 'put'
              ? 'bg-brand-600 text-white'
              : 'text-ink-600 hover:text-ink-900',
          )}
        >
          {putLabel}
        </button>
      </div>

      {/* Sliders */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <div>
          <label
            htmlFor={`${id}-vol`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{volLabel}</span>
            <span className="font-mono text-ink-900">{percent(volState)}</span>
          </label>
          <input
            id={`${id}-vol`}
            type="range"
            min={5}
            max={80}
            step={1}
            value={Math.round(volState * 100)}
            aria-valuetext={percent(volState)}
            onChange={(e) => setVolState(Number(e.target.value) / 100)}
            className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-time`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{timeLabel}</span>
            <span className="font-mono text-ink-900">{num(timeState, 1)}</span>
          </label>
          <input
            id={`${id}-time`}
            type="range"
            min={0.1}
            max={3}
            step={0.1}
            value={timeState}
            aria-valuetext={`${num(timeState, 1)} ${yearUnitLabel}`}
            onChange={(e) => setTimeState(Number(e.target.value))}
            className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
        <div>
          <label
            htmlFor={`${id}-strike`}
            className="flex items-center justify-between text-sm text-ink-700"
          >
            <span>{strikeLabel}</span>
            <span className="font-mono text-ink-900">{num(strikeState, 0)}</span>
          </label>
          <input
            id={`${id}-strike`}
            type="range"
            min={Math.round(S0 * 0.4)}
            max={Math.round(S0 * 2)}
            step={1}
            value={Math.round(strikeState)}
            aria-valuetext={num(strikeState, 0)}
            onChange={(e) => setStrikeState(Number(e.target.value))}
            className="mt-2 h-8 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
          />
        </div>
      </div>

      {/* Readouts */}
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm" aria-live="polite">
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{probItmLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-brand-700">{pct(probItm)}</dd>
        </div>
        <div className="rounded-card border border-ink-100 bg-surface-sunken/40 px-3 py-2">
          <dt className="text-ink-500">{medianPriceLabel}</dt>
          <dd className="font-mono text-lg font-semibold text-accent-600">{num(median)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LognormalPrice;
