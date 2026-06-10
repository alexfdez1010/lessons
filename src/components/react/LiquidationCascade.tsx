import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { cx } from '@/components/react/cx';

export interface LiquidationCascadeProps {
  /** Heading above the figure. */
  title?: string;
  /** One-line takeaway under the figure. */
  caption?: string;
  /** Label for the price line. */
  priceLabel?: string;
  /** Label for the "step" button. */
  stepLabel?: string;
  /** Label for the "auto-run" button. */
  runLabel?: string;
  /** Label for the "reset" button. */
  resetLabel?: string;
  /** Label for the count of positions liquidated so far. */
  liquidatedLabel?: string;
  /** Label for the shock-size slider. */
  shockLabel?: string;
  /** Label/legend for a position still alive. */
  aliveLegendLabel?: string;
  /** Label/legend for a position that has been liquidated. */
  liquidatedLegendLabel?: string;
  /** Banner text when a fresh batch of liquidations fires. */
  cascadeLabel?: string;
  /** Currency prefix. Defaults to `'$'`. */
  currencyPrefix?: string;
  /** Starting price. Defaults to `30000`. */
  startPrice?: number;
  className?: string;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Position {
  /** Liquidation price (long positions, so they trip when price falls to here). */
  liqPrice: number;
  /** Notional forced-sold when this position liquidates (in price-pressure units). */
  size: number;
}

/**
 * Liquidation-cascade simulator. A ladder of leveraged long positions sits at
 * progressively lower liquidation prices. An initial price shock pushes the
 * price down; every position whose liquidation price is now above the market
 * gets force-sold, and those forced market sells push the price down *further*,
 * tripping the next rung — a reflexive cascade. Each step advances the feedback
 * loop: liquidations → forced selling → lower price → more liquidations, until
 * it peters out. The learner sets the initial shock and steps or auto-runs the
 * loop, watching the price stair-step down and positions wink out. All numbers
 * derive from props / internal state — none are baked into the rendered figure.
 */
export function LiquidationCascade({
  title = 'One liquidation can trigger the next — a cascade',
  caption = 'Leveraged longs sit at a ladder of liquidation prices. A shock trips the highest ones; their positions are force-sold at market, and that selling pushes the price down into the next rung of liquidations. The loop — liquidate, sell, drop, repeat — is why crypto crashes happen in violent stair-steps. Step through it.',
  priceLabel = 'Price',
  stepLabel = 'Step the cascade',
  runLabel = 'Auto-run',
  resetLabel = 'Reset',
  liquidatedLabel = 'Liquidated',
  shockLabel = 'Initial shock',
  aliveLegendLabel = 'Open position',
  liquidatedLegendLabel = 'Liquidated',
  cascadeLabel = 'Forced selling pushed the price into the next liquidation rung',
  currencyPrefix = '$',
  startPrice = 30000,
  className,
}: LiquidationCascadeProps) {
  const id = useId();
  // Initial shock as a percentage drop applied before the cascade.
  const [shockPct, setShockPct] = useState(3);

  // Build a fixed ladder of positions at decreasing liquidation prices.
  const positions = useMemo<Position[]>(() => {
    const out: Position[] = [];
    for (let i = 0; i < 12; i++) {
      const drop = 0.02 + i * 0.018; // 2% … ~22% below start
      out.push({ liqPrice: startPrice * (1 - drop), size: 0.4 + (i % 3) * 0.25 });
    }
    return out;
  }, [startPrice]);

  // price = current market price; step = cascade iteration count.
  const [price, setPrice] = useState(startPrice);
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(false);
  const [justFired, setJustFired] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Which positions are dead at the current price.
  const liquidated = positions.filter((p) => p.liqPrice >= price);
  const liqCount = liquidated.length;

  // Advance one cascade iteration: apply forced-sell pressure from newly dead
  // positions, lowering the price, which may kill more next step.
  const advance = () => {
    setStep((s) => {
      if (s === 0) {
        // First step: apply the shock.
        setPrice(startPrice * (1 - shockPct / 100));
        setJustFired(true);
        return 1;
      }
      // Forced selling: each currently-liquidated position drags price down.
      setPrice((prev) => {
        const dead = positions.filter((p) => p.liqPrice >= prev);
        const pressure = dead.reduce((acc, p) => acc + p.size, 0);
        // Diminishing impact each round.
        const next = prev * (1 - (pressure / 100) * Math.pow(0.7, s));
        setJustFired(next < prev - 1);
        return next;
      });
      return s + 1;
    });
  };

  const reset = () => {
    setRunning(false);
    setStep(0);
    setPrice(startPrice);
    setJustFired(false);
  };

  // Auto-run loop.
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) {
      // Fast-forward several steps at once.
      for (let i = 0; i < 8; i++) advance();
      setRunning(false);
      return;
    }
    timerRef.current = window.setTimeout(() => {
      advance();
      if (step > 10) setRunning(false);
    }, 700);
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, step, price]);

  // Geometry.
  const W = 540;
  const Hsvg = 220;
  const padX = 24;
  const padY = 20;
  const pHigh = startPrice * 1.02;
  const pLow = startPrice * 0.7;
  const yOf = (p: number) =>
    padY + ((pHigh - Math.max(pLow, Math.min(p, pHigh))) / (pHigh - pLow)) * (Hsvg - padY * 2);

  const money = (v: number) =>
    `${currencyPrefix}${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(v)}`;

  const aria = `${priceLabel} ${money(price)}. ${liquidatedLabel} ${liqCount} of ${positions.length}.`;

  const buttonBase =
    'rounded-pill px-3 py-1.5 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500';

  const done = step > 0 && liqCount === positions.length;

  return (
    <figure
      className={cx(
        'my-6 rounded-card border border-ink-100 bg-surface p-5 shadow-soft',
        className,
      )}
    >
      <figcaption className="flex items-center justify-between gap-3">
        <span className="font-medium text-ink-900">{title}</span>
        <span className="rounded-pill bg-red-600 px-3 py-1 text-sm font-medium text-white tabular-nums">
          {liquidatedLabel}: {liqCount}/{positions.length}
        </span>
      </figcaption>

      <div className="mt-3 flex flex-wrap gap-4 text-sm">
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-full bg-accent-500" aria-hidden="true" />
          {aliveLegendLabel}
        </span>
        <span className="inline-flex items-center gap-2 text-ink-700">
          <span className="h-3 w-3 rounded-full bg-red-500" aria-hidden="true" />
          {liquidatedLegendLabel}
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${Hsvg}`} className="mt-2 w-full" role="img" aria-label={aria}>
        {/* Liquidation-price rungs */}
        {positions.map((p, i) => {
          const dead = p.liqPrice >= price;
          const y = yOf(p.liqPrice);
          return (
            <g key={i}>
              <line
                x1={padX}
                y1={y}
                x2={W - padX}
                y2={y}
                stroke={dead ? 'var(--color-danger)' : 'var(--color-ink-200)'}
                strokeWidth={1}
                strokeDasharray="2 4"
                opacity={dead ? 0.5 : 1}
              />
              <circle
                cx={W - padX - 8 - i * 6}
                cy={y}
                r={5}
                fill={dead ? 'var(--color-danger)' : 'var(--color-accent-500)'}
                opacity={dead ? 0.85 : 1}
              />
            </g>
          );
        })}

        {/* Current price line */}
        <line
          x1={padX}
          y1={yOf(price)}
          x2={W - padX}
          y2={yOf(price)}
          stroke="var(--color-brand-600)"
          strokeWidth={3}
        />
        <text x={padX} y={yOf(price) - 6} fontSize="11" fontWeight={700} fill="var(--color-brand-700)">
          {priceLabel}: {money(price)}
        </text>
      </svg>

      <div aria-live="polite">
        {justFired && step > 1 && !done && (
          <p className="mt-2 rounded-card border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            {cascadeLabel}
          </p>
        )}
      </div>

      {/* Shock slider */}
      <div className="mt-4">
        <label htmlFor={`${id}-shock`} className="flex items-center justify-between text-sm text-ink-700">
          <span>{shockLabel}</span>
          <span className="font-mono text-ink-900 tabular-nums">−{shockPct}%</span>
        </label>
        <input
          id={`${id}-shock`}
          type="range"
          min={1}
          max={10}
          step={1}
          value={shockPct}
          onChange={(e) => {
            setShockPct(Number(e.target.value));
            reset();
          }}
          className="mt-2 w-full accent-brand-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={advance}
          disabled={done || running}
          className={cx(
            buttonBase,
            done || running
              ? 'cursor-not-allowed bg-ink-200 text-ink-400'
              : 'bg-brand-600 text-white hover:bg-brand-700',
          )}
        >
          {stepLabel}
        </button>
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          disabled={done}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
            done && 'cursor-not-allowed opacity-50',
          )}
        >
          {runLabel}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={step === 0}
          className={cx(
            buttonBase,
            'border border-ink-200 text-ink-700 hover:bg-surface-sunken/60',
            step === 0 && 'cursor-not-allowed opacity-50',
          )}
        >
          {resetLabel}
        </button>
      </div>

      <p className="mt-3 text-sm leading-relaxed text-ink-600">{caption}</p>
    </figure>
  );
}

export default LiquidationCascade;
